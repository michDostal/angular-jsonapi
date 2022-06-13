import { AttributeMetadata } from '../constants/symbols';
import { AttributeDecoratorOptions } from '../interfaces/attribute-decorator-options.interface';
import { DateConverter } from '../converters/date/date.converter';
import { isEqual } from 'lodash';

export function Attribute(options: AttributeDecoratorOptions = {}): PropertyDecorator {
  // @ts-ignore
  return (target: any, propertyName: string) => {
    const converter = (dataType: any, value: any, forSerialisation = false): any => {
      let attrConverter;

      if (options.converter) {
        attrConverter = options.converter;
      }  else if (dataType) {
        if (dataType === Date) {
          attrConverter = new DateConverter();
        } else {
          const datatype = new dataType();
          if (datatype.mask && datatype.unmask) {
            attrConverter = datatype;
          }
        }
      } else {
        console.error('Cant´t determine dataType: ' + dataType);
      }

      if (attrConverter) {
        if (!forSerialisation) {
          return attrConverter.mask(value);
        }
        return attrConverter.unmask(value);
      }

      return value;
    };

    const saveAnnotations = () => {
      const metadata = Reflect.getMetadata('Attribute', target) || {};

      metadata[propertyName] = {
        marked: true
      };

      Reflect.defineMetadata('Attribute', metadata, target);

      const mappingMetadata = Reflect.getMetadata('AttributeMapping', target) || {};
      const serializedPropertyName = options.serializedName !== undefined ? options.serializedName : propertyName;
      mappingMetadata[serializedPropertyName] = propertyName;
      Reflect.defineMetadata('AttributeMapping', mappingMetadata, target);
    };

    const setMetadata = (
      instance: any,
      oldValue: any,
      newValue: any
    ) => {
      const targetType = Reflect.getMetadata('design:type', target, propertyName);

      if (!instance[AttributeMetadata]) {
        instance[AttributeMetadata] = {};
      }
      instance[AttributeMetadata][propertyName] = {
        newValue,
        oldValue,
        nested: false,
        serializedName: options.serializedName,
        hasDirtyAttributes: !isEqual(oldValue, newValue),
        serialisationValue: converter(targetType, newValue, true)
      };
    };

    const getter = () => {
      // @ts-ignore
      return this[`_${propertyName}`];
    };

    const setter = function(newVal: any) {
      const targetType = Reflect.getMetadata('design:type', target, propertyName);
      const convertedValue = converter(targetType, newVal);
      let oldValue = null;
      // @ts-ignore
      if (this.isModelInitialization() && this.id) {
        oldValue = converter(targetType, newVal);
      } else {
        // @ts-ignore
        if (this[AttributeMetadata] && this[AttributeMetadata][propertyName]) {
          // @ts-ignore
          oldValue = this[AttributeMetadata][propertyName].oldValue;
        }
      }
      // @ts-ignore
      this[`_${propertyName}`] = convertedValue;
      // @ts-ignore
      setMetadata(this, oldValue, convertedValue);
    };

    if (delete target[propertyName]) {
      saveAnnotations();
      Object.defineProperty(target, propertyName, {
        get: getter,
        set: setter,
        enumerable: true,
        configurable: true
      });
    }
  };
}
